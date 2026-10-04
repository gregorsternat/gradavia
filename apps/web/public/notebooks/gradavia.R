# Download and reproduce one Gradavia public snapshot.
# Requires R and jsonlite: install.packages("jsonlite")
# Source families and their denominators must remain separate.
if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Install jsonlite first: install.packages('jsonlite')")
}
base_url <- Sys.getenv("GRADAVIA_API_BASE_URL", "https://gradavia.com")
family <- "parcoursup" # or "apprentissage", "apb"
campaign <- ""        # latest published campaign when empty
version <- ""         # paste source$releaseId for exact reproduction
parameters <- c(famille = family, format = "json")
if (nzchar(campaign)) parameters <- c(parameters, campagne = campaign)
if (nzchar(version)) parameters <- c(parameters, version = version)
make_url <- function(parameters) {
  query <- paste(names(parameters), vapply(parameters, utils::URLencode, character(1), reserved = TRUE), sep = "=", collapse = "&")
  paste0(sub("/$", "", base_url), "/api/v1/datasets?", query)
}
# Fail explicitly for network errors or an unimported family.
options(timeout = 30)
connection <- url(make_url(parameters), open = "rb")
raw_payload <- tryCatch(readBin(connection, what = "raw", n = 32L * 1024L * 1024L + 1L), finally = close(connection))
if (length(raw_payload) > 32L * 1024L * 1024L) stop("Dataset response exceeds the 32 MiB limit")
payload <- jsonlite::fromJSON(rawToChar(raw_payload), simplifyVector = FALSE)
if (!identical(payload$status, "ready")) stop("No published dataset for these parameters")
data <- payload$data
source <- data$source
stopifnot(identical(data$family, family))
if (nzchar(version)) stopifnot(identical(tolower(source$releaseId), tolower(version)))
if (nzchar(campaign)) stopifnot(source$campaign == as.integer(campaign))
parameters["campagne"] <- as.character(source$campaign)
parameters["version"] <- source$releaseId
pinned_url <- make_url(parameters)
cat("Campaign:", source$campaign, "\nRows:", length(data$items), "\nVersion:", source$releaseId, "\nSource:", pinned_url, "\n")
# Missing, suppressed and invalid values stay distinct from observed zero.
ids <- vapply(data$items, function(row) row$id, character(1))
stopifnot(length(unique(ids)) == length(ids))
stopifnot(all(startsWith(ids, paste0(source$releaseId, ":"))))
for (row in data$items) {
  for (key in names(row$metrics)) {
    state <- row$states[[key]]
    if (is.null(state)) state <- "observed"
    stopifnot(state %in% c("observed", "missing", "suppressed", "invalid"))
    stopifnot(identical(!is.null(row$metrics[[key]]), state == "observed"))
  }
}
for (coverage in data$coverage) {
  stopifnot(sum(unlist(coverage[c("observed", "missing", "suppressed", "invalid")])) == length(data$items))
}
capacity <- vapply(data$items, function(row) if (is.null(row$metrics$capacity)) NA_real_ else row$metrics$capacity, numeric(1))
observed <- sum(!is.na(capacity))
print(data.frame(campaign = source$campaign, published_capacity = if (observed > 0) sum(capacity, na.rm = TRUE) else NA_real_, observed_rows = observed, total_rows = length(capacity)))
# Do not interpret summed applications as unique people or average access rates.
# Keep the immutable snapshot, source, definitions, coverage and license together.
dir.create("gradavia-export", showWarnings = FALSE)
filename <- file.path("gradavia-export", paste0(family, "-", source$campaign, "-", source$releaseId, ".json"))
# Preserve the original bytes, including empty JSON objects and null fields.
writeBin(raw_payload, filename)
writeLines(pinned_url, file.path("gradavia-export", "source-url.txt"))
cat("Saved:", filename, "\n")
