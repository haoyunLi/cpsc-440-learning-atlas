# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: course-cases
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce both source examples from summaries; no raw data are invented.
examples <- data.frame(
  case = c("Example 1", "Count trees"),
  n = c(168, 50), ybar = c(36.92, 27.3),
  sd_value = c(6.73, 12.1), confidence = c(.95, .99))
result <- do.call(rbind, lapply(seq_len(nrow(examples)), function(i) {
  e <- examples[i, ]
  se <- e$sd_value / sqrt(e$n)
  z_critical <- qnorm((1 + e$confidence) / 2)
  t_critical <- qt((1 + e$confidence) / 2, df = e$n - 1)
  # The z formula is exact for known sigma under normal sampling.
  # With sample s, the same numeric z formula is a large-sample approximation.
  # The t formula is exact for unknown sigma under normal sampling.
  data.frame(case = e$case, df = e$n - 1, SE = se,
    z_critical = z_critical, t_critical = t_critical,
    z_lower = e$ybar - z_critical * se,
    z_upper = e$ybar + z_critical * se,
    t_lower = e$ybar - t_critical * se,
    t_upper = e$ybar + t_critical * se)
}))
print(result, digits = 10, row.names = FALSE)
stopifnot(all(result$t_lower < result$z_lower),
          all(result$t_upper > result$z_upper))
