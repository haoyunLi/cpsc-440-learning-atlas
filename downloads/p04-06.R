p <- seq(0.10, 0.55, by = 0.05)
c(mean_count = sum(p), actual_variance = sum(p * (1-p)),
  binomial_variance = length(p) * mean(p) * (1-mean(p)))
