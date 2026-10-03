use crate::{
    archive::{self, Artifact},
    error::{IngestError, Result},
    registry::Dataset,
};
use reqwest::blocking::Client;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    thread,
    time::{Duration, SystemTime},
};
use url::Url;

/// Construct and drop this synchronous adapter inside a blocking task.
pub struct SourceClient {
    client: Client,
    base: Url,
}

impl SourceClient {
    pub fn new(base: Url) -> Result<Self> {
        if !base.path().ends_with('/')
            || base.username() != ""
            || base.password().is_some()
            || !matches!(base.scheme(), "http" | "https")
        {
            return Err(IngestError::new("invalid_catalog_url"));
        }
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(600))
            .gzip(true)
            .redirect(reqwest::redirect::Policy::limited(3))
            .user_agent(concat!(
                "Orvio/",
                env!("CARGO_PKG_VERSION"),
                " public-data-archiver"
            ))
            .build()
            .map_err(|_| IngestError::new("http_client_failed"))?;
        Ok(Self { client, base })
    }

    fn endpoint(&self, source: &Dataset, suffix: &str) -> Result<Url> {
        self.base
            .join(&format!("{}{}", source.id, suffix))
            .map_err(|_| IngestError::new("invalid_source_url"))
    }

    fn download(&self, url: &Url, root: &Path, name: &str, limit: u64) -> Result<Artifact> {
        for attempt in 0..3 {
            let target = root.join(name);
            let mut request = self.client.get(url.clone());
            // The map export spans seven campaigns. Allow a bounded hour for
            // complete exports over slower links; small resources keep 10 min.
            if name == "records.jsonl.gz" {
                request = request.timeout(Duration::from_secs(3600));
            }
            let response = request.send();
            let mut delay = Duration::from_secs(1 << attempt);
            let result = match response {
                Ok(response) if response.status().is_success() => {
                    archive::compress_response(response, &target, url.as_str(), limit)
                }
                Ok(response) => {
                    let status = response.status();
                    if !(status.is_server_error()
                        || status.as_u16() == 429
                        || status.as_u16() == 408)
                    {
                        return Err(IngestError::new("http_source_rejected"));
                    }
                    if let Some(value) = response
                        .headers()
                        .get(reqwest::header::RETRY_AFTER)
                        .and_then(|v| v.to_str().ok())
                    {
                        delay = value
                            .parse::<u64>()
                            .map(Duration::from_secs)
                            .ok()
                            .or_else(|| {
                                httpdate::parse_http_date(value)
                                    .ok()
                                    .and_then(|when| when.duration_since(SystemTime::now()).ok())
                            })
                            .unwrap_or(delay);
                    }
                    Err(IngestError::new("http_transient_failure"))
                }
                Err(_) => Err(IngestError::new("http_transport_failed")),
            };
            match result {
                Ok(artifact) => return Ok(artifact),
                Err(error) => {
                    // Preserve interrupted transfer bytes for diagnosis; never
                    // treat them as complete or overwrite them on a retry.
                    let partial = target.with_extension("partial");
                    if partial.exists() {
                        fs::rename(
                            partial,
                            root.join(format!("{name}.attempt-{attempt}.partial")),
                        )?;
                    }
                    if attempt == 2
                        || error.code == "source_size_limit"
                        || delay > Duration::from_secs(60)
                    {
                        return Err(error);
                    }
                    tracing::warn!(target: "orvio_ingest", event="download_retry", artifact=name, attempt=attempt+1, code=error.code, delay_seconds=delay.as_secs());
                    thread::sleep(delay);
                }
            }
        }
        Err(IngestError::new("http_attempts_exhausted"))
    }

    pub fn collect(&self, source: &Dataset, run_root: &Path) -> Result<PathBuf> {
        fs::create_dir_all(run_root)?;
        for attempt in 1..=3 {
            let root = run_root.join(format!("attempt-{attempt}"));
            fs::create_dir(&root)?;
            let result = self.collect_once(source, &root);
            match result {
                Ok(manifest) => return Ok(manifest),
                Err(error) => {
                    archive::write_json(&root.join("failure.json"), &error)?;
                    if error.code != "source_changed_during_download" || attempt == 3 {
                        return Err(error);
                    }
                }
            }
        }
        Err(IngestError::new("source_changed_during_download"))
    }

    fn collect_once(&self, source: &Dataset, root: &Path) -> Result<PathBuf> {
        let metadata_url = self.endpoint(source, "")?;
        let metadata_artifact =
            self.download(&metadata_url, root, "metadata.json.gz", 16 * 1024 * 1024)?;
        let before = archive::read_metadata(root, &metadata_artifact)?;
        // Preserve all source bytes before validating representation.
        let data = self.download(
            &self.endpoint(source, "/exports/jsonl")?,
            root,
            "records.jsonl.gz",
            2 * 1024 * 1024 * 1024,
        )?;
        let mut attachments = BTreeMap::new();
        let source_attachments = before["attachments"]
            .as_array()
            .ok_or_else(|| IngestError::new("invalid_attachment_metadata"))?;
        if source_attachments.len() > 100 {
            return Err(IngestError::new("attachment_count_limit"));
        }
        for attachment in source_attachments {
            let id = attachment["id"]
                .as_str()
                .filter(|id| {
                    !id.is_empty()
                        && id.len() <= 180
                        && id
                            .bytes()
                            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
                })
                .ok_or_else(|| IngestError::new("invalid_attachment_id"))?;
            let artifact = self.download(
                &self.endpoint(source, &format!("/attachments/{id}"))?,
                root,
                &format!("attachment-{id}.gz"),
                128 * 1024 * 1024,
            )?;
            if attachments.insert(id.to_owned(), artifact).is_some() {
                return Err(IngestError::new("duplicate_attachment_id"));
            }
        }
        let after_artifact = self.download(
            &metadata_url,
            root,
            "metadata-after.json.gz",
            16 * 1024 * 1024,
        )?;
        let after = archive::read_metadata(root, &after_artifact)?;
        if archive::source_revision(&before)? != archive::source_revision(&after)? {
            return Err(IngestError::new("source_changed_during_download"));
        }
        let manifest = archive::describe(
            source,
            root,
            metadata_artifact,
            data,
            attachments,
            chrono::Utc::now().to_rfc3339(),
        )?;
        let path = root.join("manifest.json");
        archive::write_json(&path, &manifest)?;
        Ok(path)
    }
}
