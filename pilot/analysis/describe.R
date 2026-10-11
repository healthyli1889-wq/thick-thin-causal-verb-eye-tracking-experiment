# Rscript analysis/describe.R analysis/derived
args <- commandArgs(trailingOnly=TRUE)
root <- if(length(args)) args[1] else 'analysis/derived'
p <- read.csv(file.path(root, 'participants.csv'), na.strings='', stringsAsFactors=FALSE)
t <- read.csv(file.path(root, 'trials.csv'), na.strings='', stringsAsFactors=FALSE)
stopifnot(!anyDuplicated(p$session_id), all(t$session_id %in% p$session_id))
is_preview <- if('mode' %in% names(p)) !is.na(p$mode) & p$mode == 'preview' else rep(FALSE, nrow(p))
is_synthetic <- if('synthetic_test_data' %in% names(p)) !is.na(p$synthetic_test_data) & tolower(as.character(p$synthetic_test_data)) == 'true' else rep(FALSE, nrow(p))
include_synthetic <- '--include-synthetic' %in% args
included <- !is_preview & (include_synthetic | !is_synthetic)
study_ids <- p$session_id[included]
cat('Excluded preview/test sessions:', sum(!included), '\n')
choices <- subset(t, session_id %in% study_ids & task == 'choice' & selected_role %in% c('distal','proximal'))
print(with(choices, table(condition, selected_role)))
# Keep subject and item grouping for future preregistered mixed models.
# Current material/AOI/onset limitations preclude confirmatory interpretation.
