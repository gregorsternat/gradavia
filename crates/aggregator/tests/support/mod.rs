#![allow(dead_code)]
use gradavia_aggregator::{archive, registry::Dataset};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};
use url::Url;

pub struct TestDirectory(Option<tempfile::TempDir>);
impl TestDirectory {
    pub fn path(&self) -> &Path {
        self.0.as_ref().unwrap().path()
    }
}
impl Drop for TestDirectory {
    fn drop(&mut self) {
        if std::thread::panicking()
            && let Some(directory) = self.0.take()
        {
            eprintln!(
                "Retained failed-test archive: {}",
                directory.keep().display()
            );
        }
    }
}
pub fn tempdir() -> TestDirectory {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.artifacts/ingestion-tests");
    fs::create_dir_all(&root).unwrap();
    TestDirectory(Some(tempfile::tempdir_in(root).unwrap()))
}

pub fn fixture(source: &Dataset) -> (Value, Vec<Value>) {
    let folder = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(&source.id);
    let mut metadata: Value =
        serde_json::from_slice(&fs::read(folder.join("metadata.json")).unwrap()).unwrap();
    let data = fs::read_to_string(folder.join("records.jsonl")).unwrap();
    let records: Vec<Value> = data
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    metadata["metas"]["default"]["records_count"] = Value::from(records.len());
    metadata["attachments"] = serde_json::json!([]);
    (metadata, records)
}

pub fn jsonl(records: &[Value]) -> Vec<u8> {
    records
        .iter()
        .flat_map(|record| {
            let mut bytes = serde_json::to_vec(record).unwrap();
            bytes.push(b'\n');
            bytes
        })
        .collect()
}

pub fn make_archive(
    root: &Path,
    source: &Dataset,
    mut metadata: Value,
    records: &[Value],
) -> PathBuf {
    fs::create_dir_all(root).unwrap();
    metadata["metas"]["default"]["records_count"] = Value::from(records.len());
    let metadata_bytes = serde_json::to_vec(&metadata).unwrap();
    let metadata_artifact = archive::compress_response(
        &metadata_bytes[..],
        &root.join("metadata.json.gz"),
        "https://example.test/metadata",
        16 * 1024 * 1024,
    )
    .unwrap();
    let data = archive::compress_response(
        &jsonl(records)[..],
        &root.join("records.jsonl.gz"),
        "https://example.test/export",
        128 * 1024 * 1024,
    )
    .unwrap();
    let manifest = archive::describe(
        source,
        root,
        metadata_artifact,
        data,
        BTreeMap::new(),
        "2026-10-03T00:00:00Z".into(),
    )
    .unwrap();
    let path = root.join("manifest.json");
    archive::write_json(&path, &manifest).unwrap();
    path
}

pub struct Response {
    pub status: u16,
    pub body: Vec<u8>,
    pub headers: Vec<(String, String)>,
    pub reported_length: Option<usize>,
}
impl Response {
    pub fn ok(body: Vec<u8>) -> Self {
        Self {
            status: 200,
            body,
            headers: Vec::new(),
            reported_length: None,
        }
    }
}

pub struct Server {
    pub base: Url,
    stop: Arc<AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}
impl Server {
    pub fn start(handler: impl Fn(&str) -> Response + Send + 'static) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let base = Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let stopped = stop.clone();
        let thread = thread::spawn(move || {
            while !stopped.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        // Darwin can inherit nonblocking mode on accepted sockets.
                        stream.set_nonblocking(false).unwrap();
                        stream
                            .set_read_timeout(Some(Duration::from_secs(5)))
                            .unwrap();
                        let mut reader = BufReader::new(stream.try_clone().unwrap());
                        let mut line = String::new();
                        if reader.read_line(&mut line).is_err() {
                            continue;
                        }
                        let path = line.split_whitespace().nth(1).unwrap_or("/").to_owned();
                        loop {
                            line.clear();
                            if reader.read_line(&mut line).unwrap_or(0) == 0 || line == "\r\n" {
                                break;
                            }
                        }
                        let response = handler(&path);
                        let mut headers = format!(
                            "HTTP/1.1 {} Test\r\nContent-Length: {}\r\nConnection: close\r\n",
                            response.status,
                            response.reported_length.unwrap_or(response.body.len())
                        );
                        for (key, value) in response.headers {
                            headers.push_str(&format!("{key}: {value}\r\n"));
                        }
                        headers.push_str("\r\n");
                        let _ = stream.write_all(headers.as_bytes());
                        let _ = stream.write_all(&response.body);
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5))
                    }
                    Err(_) => break,
                }
            }
        });
        Self {
            base,
            stop,
            thread: Some(thread),
        }
    }
}
impl Drop for Server {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            thread.join().unwrap();
        }
    }
}
