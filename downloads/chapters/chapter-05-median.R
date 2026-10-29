# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 05, section: median
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

y <- c(18,7,12,9,35,11,6,14,10)
confidence <- .95
n <- length(y)
ordered <- sort(y)
# Search all symmetric, nested order-statistic intervals.
candidate_k <- seq_len(floor(n/2))
lower_tail <- pbinom(candidate_k-1,n,.5)
coverage <- 1-2*lower_tail
index_table <- data.frame(k=candidate_k,lower_tail=lower_tail,
                          coverage=coverage)
print(index_table)
eligible <- candidate_k[coverage >= confidence]
stopifnot(length(eligible) > 0)
k <- max(eligible)
indices <- c(k,n-k+1)
ci <- ordered[indices]
actual_coverage <- coverage[match(k,candidate_k)]
print(ordered)
print(c(k=k,lower_index=indices[1],upper_index=indices[2],
        lower=ci[1],upper=ci[2],coverage=actual_coverage))
stopifnot(k==2,all(ci==c(7,18)),
          abs(actual_coverage-.9609375) < 1e-12)
# With five observations, even the widest finite interval falls short.
n_small <- 5
best_finite_coverage <- 1-2*pbinom(0,n_small,.5)
print(c(n=n_small,best_finite_coverage=best_finite_coverage,
        meets_target=best_finite_coverage >= confidence))
stopifnot(best_finite_coverage < confidence)
