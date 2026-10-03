use crate::{
    error::{IngestError, Result},
    registry::{Dataset, IMPORTER_VERSION},
};
use flate2::{Compression, read::GzDecoder, write::GzEncoder};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{BufRead, BufReader, Read, Write},
    path::{Component, Path, PathBuf},
};

pub const MAX_RECORD_BYTES: usize = 4 * 1024 * 1024;
const MAX_ROWS: usize = 2_000_000;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Artifact {
    pub path: String,
    pub url: String,
    /// SHA-256 and byte length of the exact uncompressed response body.
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u32,
    pub dataset_id: String,
    pub contract_version: u32,
    pub importer_version: String,
    pub collected_at: String,
    pub metadata: Artifact,
    pub data: Artifact,
    pub attachments: BTreeMap<String, Artifact>,
    pub fingerprint: String,
    pub row_count: u64,
    pub campaigns: BTreeMap<i32, u64>,
}

#[derive(Debug)]
pub struct ValidatedArchive {
    pub manifest: Manifest,
    pub metadata: Value,
    pub manifest_path: PathBuf,
    pub data_path: PathBuf,
}

pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn canonical_hash(value: &Value) -> Result<String> {
    Ok(hash(&serde_json::to_vec(value)?))
}

pub fn write_json(path: &Path, value: &impl Serialize) -> Result<()> {
    let mut file = File::options().write(true).create_new(true).open(path)?;
    serde_json::to_writer_pretty(&mut file, value)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    Ok(())
}

/// Compress without changing the response bytes; never commit a partial file.
pub fn compress_response(
    mut input: impl Read,
    path: &Path,
    url: &str,
    limit: u64,
) -> Result<Artifact> {
    let partial = path.with_extension("partial");
    let mut output = GzEncoder::new(
        File::options()
            .write(true)
            .create_new(true)
            .open(&partial)?,
        Compression::default(),
    );
    let mut digest = Sha256::new();
    let mut bytes = 0u64;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let length = match input.read(&mut buffer) {
            Ok(length) => length,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => {
                let code = match error.kind() {
                    std::io::ErrorKind::ConnectionReset => "response_connection_reset",
                    std::io::ErrorKind::UnexpectedEof => "response_unexpected_eof",
                    std::io::ErrorKind::TimedOut => "response_read_timeout",
                    std::io::ErrorKind::WouldBlock => "response_would_block",
                    _ => "response_body_read_failed",
                };
                return Err(IngestError::new(code));
            }
        };
        if length == 0 {
            break;
        }
        bytes += length as u64;
        if bytes > limit {
            return Err(IngestError::new("source_size_limit"));
        }
        digest.update(&buffer[..length]);
        output.write_all(&buffer[..length])?;
    }
    output.finish()?.sync_all()?;
    fs::rename(&partial, path)?;
    Ok(Artifact {
        path: path
            .file_name()
            .and_then(|p| p.to_str())
            .ok_or_else(|| IngestError::new("invalid_archive_path"))?
            .into(),
        url: url.into(),
        sha256: format!("{:x}", digest.finalize()),
        bytes,
    })
}

pub fn artifact_path(root: &Path, artifact: &Artifact) -> Result<PathBuf> {
    let relative = Path::new(&artifact.path);
    if relative.components().count() != 1
        || !matches!(relative.components().next(), Some(Component::Normal(_)))
    {
        return Err(IngestError::new("invalid_archive_path"));
    }
    let path = root.join(relative);
    if fs::symlink_metadata(&path)?.file_type().is_symlink() {
        return Err(IngestError::new("invalid_archive_path"));
    }
    Ok(path)
}

pub fn verify_artifact(root: &Path, artifact: &Artifact) -> Result<()> {
    let path = artifact_path(root, artifact)?;
    let mut input = GzDecoder::new(File::open(path)?);
    let mut digest = Sha256::new();
    let mut count = 0;
    let mut buffer = [0; 64 * 1024];
    loop {
        let size = input
            .read(&mut buffer)
            .map_err(|_| IngestError::new("corrupt_archive"))?;
        if size == 0 {
            break;
        }
        count += size as u64;
        if count > artifact.bytes {
            return Err(IngestError::new("archive_checksum_mismatch"));
        }
        digest.update(&buffer[..size]);
    }
    if count != artifact.bytes || format!("{:x}", digest.finalize()) != artifact.sha256 {
        return Err(IngestError::new("archive_checksum_mismatch"));
    }
    Ok(())
}

pub fn read_metadata(root: &Path, artifact: &Artifact) -> Result<Value> {
    let reader = GzDecoder::new(File::open(artifact_path(root, artifact)?)?);
    Ok(serde_json::from_reader(reader.take(16 * 1024 * 1024))?)
}

/// Keep source revision timestamps for race detection and provenance, but not
/// volatile processing timestamps in content identity. Field order is irrelevant.
pub fn relevant_metadata(metadata: &Value) -> Result<Value> {
    let mut fields = metadata["fields"]
        .as_array()
        .cloned()
        .ok_or_else(|| IngestError::new("missing_source_schema"))?;
    fields.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    let default = &metadata["metas"]["default"];
    Ok(json!({
        "dataset_id": metadata["dataset_id"], "fields": fields,
        "title": default["title"], "description": default["description"],
        "license": default["license"], "license_url": default["license_url"],
        "publisher": default["publisher"], "references": default["references"],
        "source": default["source"], "attributions": default["attributions"]
    }))
}

pub fn source_revision(metadata: &Value) -> Result<String> {
    let default = &metadata["metas"]["default"];
    canonical_hash(
        &json!({"content":relevant_metadata(metadata)?, "modified":default["modified"], "data_processed":default["data_processed"], "records_count":default["records_count"], "attachments":metadata["attachments"]}),
    )
}

/// Read one record at a time, with an explicit bound before allocation grows.
pub fn visit_records(
    path: &Path,
    mut visit: impl FnMut(u64, &[u8], &Value) -> Result<()>,
) -> Result<()> {
    let mut reader = BufReader::new(GzDecoder::new(File::open(path)?));
    let mut line = Vec::new();
    let mut row = 0;
    loop {
        line.clear();
        let length = Read::by_ref(&mut reader)
            .take((MAX_RECORD_BYTES + 1) as u64)
            .read_until(b'\n', &mut line)?;
        if length == 0 {
            break;
        }
        row += 1;
        if length > MAX_RECORD_BYTES {
            return Err(IngestError::new("record_size_limit").at(row));
        }
        if row as usize > MAX_ROWS {
            return Err(IngestError::new("record_count_limit").at(row));
        }
        let record = crate::json::parse(&line).map_err(|error| error.at(row))?;
        visit(row, &line, &record)?;
    }
    Ok(())
}

pub fn describe(
    source: &Dataset,
    root: &Path,
    metadata_artifact: Artifact,
    data: Artifact,
    attachments: BTreeMap<String, Artifact>,
    collected_at: String,
) -> Result<Manifest> {
    let metadata = read_metadata(root, &metadata_artifact)?;
    source.validate_metadata(&metadata)?;
    let expected = metadata["metas"]["default"]["records_count"]
        .as_u64()
        .filter(|n| *n > 0)
        .ok_or_else(|| IngestError::new("invalid_source_count"))?;
    let mut row_hashes: Vec<[u8; 32]> = Vec::new();
    let mut campaigns = BTreeMap::new();
    visit_records(&artifact_path(root, &data)?, |row, _, value| {
        let projection = source.project(value).map_err(|error| error.at(row))?;
        *campaigns.entry(projection.campaign).or_insert(0u64) += 1;
        row_hashes.push(Sha256::digest(serde_json::to_vec(value)?).into());
        Ok(())
    })?;
    if row_hashes.len() as u64 != expected {
        return Err(IngestError::new("row_count_mismatch"));
    }
    // A sorted multiset keeps duplicate source rows while ignoring export order.
    // The hard row limit bounds this buffer to 64 MB; payloads are streamed.
    row_hashes.sort_unstable();
    let mut digest = Sha256::new();
    digest.update(b"orvio-raw-v1\0");
    digest.update(serde_json::to_vec(&json!({"dataset":source.id, "contract":source.contract_version, "metadata":relevant_metadata(&metadata)?, "attachments":attachments.iter().map(|(id, a)| (id, &a.sha256)).collect::<BTreeMap<_,_>>()}))?);
    for row_hash in row_hashes {
        digest.update(row_hash);
    }
    Ok(Manifest {
        version: 1,
        dataset_id: source.id.clone(),
        contract_version: source.contract_version,
        importer_version: IMPORTER_VERSION.into(),
        collected_at,
        metadata: metadata_artifact,
        data,
        attachments,
        fingerprint: format!("{:x}", digest.finalize()),
        row_count: expected,
        campaigns,
    })
}

pub fn validate_manifest(path: &Path, source: &Dataset) -> Result<ValidatedArchive> {
    let manifest: Manifest = serde_json::from_reader(File::open(path)?.take(1024 * 1024))?;
    if manifest.version != 1
        || manifest.dataset_id != source.id
        || manifest.contract_version != source.contract_version
    {
        return Err(IngestError::new("manifest_contract_mismatch"));
    }
    let root = path
        .parent()
        .ok_or_else(|| IngestError::new("invalid_archive_path"))?;
    for artifact in [&manifest.metadata, &manifest.data]
        .into_iter()
        .chain(manifest.attachments.values())
    {
        verify_artifact(root, artifact)?;
    }
    let described = describe(
        source,
        root,
        manifest.metadata.clone(),
        manifest.data.clone(),
        manifest.attachments.clone(),
        manifest.collected_at.clone(),
    )?;
    if described.fingerprint != manifest.fingerprint
        || described.row_count != manifest.row_count
        || described.campaigns != manifest.campaigns
    {
        return Err(IngestError::new("manifest_content_mismatch"));
    }
    let metadata = read_metadata(root, &manifest.metadata)?;
    // Every attached method document is part of replay, including its checksum.
    let attachment_ids: Vec<&str> = metadata["attachments"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|a| a["id"].as_str())
        .collect();
    if attachment_ids.len() != manifest.attachments.len()
        || attachment_ids
            .iter()
            .any(|id| !manifest.attachments.contains_key(*id))
    {
        return Err(IngestError::new("missing_method_attachment"));
    }
    chrono::DateTime::parse_from_rfc3339(&manifest.collected_at)
        .map_err(|_| IngestError::new("invalid_collection_time"))?;
    Ok(ValidatedArchive {
        data_path: artifact_path(root, &manifest.data)?,
        metadata,
        manifest_path: fs::canonicalize(path)?,
        manifest,
    })
}
