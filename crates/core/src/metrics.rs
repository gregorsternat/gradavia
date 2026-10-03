//! Statistical values keep absence and suppression distinct from an observed zero.
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ValueState {
    Observed,
    Missing,
    Suppressed,
    Invalid,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricValue {
    pub value: Option<f64>,
    pub state: ValueState,
    pub source_field: String,
}

impl MetricValue {
    pub fn parse(field: &str, raw: Option<&str>, percentage: bool) -> Self {
        let raw = raw.map(str::trim).unwrap_or_default();
        let normalized = raw.to_lowercase();
        let decimal_representation = raw.split('.').count() <= 2
            && raw
                .split('.')
                .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()));
        let integer_representation = raw
            .split_once('.')
            .is_none_or(|(_, fraction)| fraction.bytes().all(|byte| byte == b'0'));
        let (state, value) = if matches!(normalized.as_str(), "" | "na" | "n/a" | "nd" | "null") {
            (ValueState::Missing, None)
        } else if matches!(
            normalized.as_str(),
            "ns" | "n.s." | "s" | "ss" | "secret" | "*" | "<5" | "< 5"
        ) {
            (ValueState::Suppressed, None)
        } else {
            match raw.parse::<f64>() {
                Ok(value)
                    if decimal_representation
                        && value.is_finite()
                        && value >= 0.0
                        && if percentage {
                            value <= 100.0
                        } else {
                            integer_representation
                                && value.fract() == 0.0
                                && value <= 9_007_199_254_740_991.0
                        } =>
                {
                    (ValueState::Observed, Some(value))
                }
                _ => (ValueState::Invalid, None),
            }
        };
        Self {
            value,
            state,
            source_field: field.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_observed_zero_missing_and_statistical_secrecy() {
        assert_eq!(MetricValue::parse("n", Some("0"), false).value, Some(0.0));
        for marker in [None, Some(""), Some("nd")] {
            assert_eq!(
                MetricValue::parse("n", marker, false).state,
                ValueState::Missing
            );
        }
        for marker in ["ns", " NS ", "<5", "*"] {
            let metric = MetricValue::parse("n", Some(marker), false);
            assert_eq!(metric.state, ValueState::Suppressed);
            assert_eq!(metric.value, None);
        }
    }

    #[test]
    fn rejects_invalid_domains_without_imputation() {
        for raw in ["-1", "NaN", "inf", "words", "3.5", "9007199254740992"] {
            assert_eq!(
                MetricValue::parse("n", Some(raw), false).state,
                ValueState::Invalid
            );
        }
        assert_eq!(
            MetricValue::parse("p", Some("101"), true).state,
            ValueState::Invalid
        );
        assert_eq!(
            MetricValue::parse("p", Some("12.5"), true).value,
            Some(12.5)
        );
    }
}
