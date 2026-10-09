//! Compact title/establishment/city search for the existing modality comparison.
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

fn fold(s: &str) -> String {
    s.nfd()
        .filter(|c| !is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .collect::<String>()
        .replace('œ', "oe")
        .replace('æ', "ae")
}
#[derive(Serialize, Deserialize)]
struct Row<'a> {
    #[serde(borrow)]
    id: &'a str,
    #[serde(borrow)]
    search: &'a str,
}
#[derive(Serialize, Deserialize)]
struct Index<'a> {
    #[serde(borrow)]
    source: &'a str,
    #[serde(borrow)]
    rows: Vec<Row<'a>>,
}
pub struct Selection {
    pub response: Value,
    pub selected: Option<String>,
    pub candidates: Vec<String>,
}
pub fn encode(snapshot: &Value) -> Result<Vec<u8>, &'static str> {
    let source =
        serde_json::to_string(&snapshot["data"]["source"]).map_err(|_| "Invalid source")?;
    let items = snapshot["data"]["items"]
        .as_array()
        .ok_or("Invalid items")?;
    let texts: Vec<_> = items
        .iter()
        .map(|item| {
            fold(&format!(
                "{} {} {}",
                item["title"].as_str().unwrap_or_default(),
                item["establishment"].as_str().unwrap_or_default(),
                item["city"].as_str().unwrap_or_default()
            ))
        })
        .collect();
    let rows = items
        .iter()
        .zip(&texts)
        .map(|(item, search)| {
            Ok(Row {
                id: item["id"].as_str().ok_or("Invalid identity")?,
                search,
            })
        })
        .collect::<Result<Vec<_>, &'static str>>()?;
    postcard::to_allocvec(&Index {
        source: &source,
        rows,
    })
    .map_err(|_| "Invalid choice index")
}
pub fn search(bytes: &[u8], id: &str, q: &str) -> Result<Selection, &'static str> {
    if bytes.len() > crate::MAX_INDEX_BYTES {
        return Err("Index too large");
    }
    let index: Index<'_> = postcard::from_bytes(bytes).map_err(|_| "Invalid choice index")?;
    let text = fold(q);
    let words: Vec<_> = text.split_whitespace().collect();
    let mut candidates = Vec::new();
    let mut total = 0;
    let mut selected = None;
    for row in index.rows {
        if row.id == id {
            selected = Some(row.id.to_owned());
        }
        if words.iter().all(|word| row.search.contains(word)) {
            total += 1;
            if candidates.len() < 8 {
                candidates.push(row.id.to_owned());
            }
        }
    }
    let source: Value = serde_json::from_str(index.source).map_err(|_| "Invalid source")?;
    Ok(Selection {
        response: json!({"status":"ready","data":{"source":source,"selected":null,"candidates":[],"total":total,"q":q}}),
        selected,
        candidates,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modality_search_preserves_selection_scope_literal_text_and_limit() {
        let mut items: Vec<_> = (0..12).map(|i| json!({"id":format!("row-{i}"),"title":"Lycée Cœur", "establishment":"École", "city":"Paris"})).collect();
        items.push(json!({"id":"selected","title":"Autre","establishment":"25%_","city":"Lyon"}));
        let source = json!({"campaign":2025,"releaseId":"release"});
        let bytes = encode(&json!({"data":{"source":source,"items":items}})).unwrap();
        let result = search(&bytes, "selected", "COEUR ecole").unwrap();
        assert_eq!(result.selected.as_deref(), Some("selected"));
        assert_eq!(result.candidates.len(), 8);
        assert_eq!(result.response["data"]["total"], 12);
        assert_eq!(result.response["data"]["source"], source);
        assert_eq!(
            search(&bytes, "missing", "%_").unwrap().candidates,
            ["selected"]
        );
        assert!(
            search(&bytes, "missing", "introuvable")
                .unwrap()
                .selected
                .is_none()
        );
        assert!(search(&[], "", "").is_err());
    }
}
