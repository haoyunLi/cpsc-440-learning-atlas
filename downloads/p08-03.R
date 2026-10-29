# Back-transform a fitted log-mean difference, not a known population parameter.
delta_log_estimate <- log(1.5)
ratio_geometric_means_estimate <- exp(delta_log_estimate)
print(c(estimated_geometric_mean_ratio = ratio_geometric_means_estimate))
# No standard error or confidence interval was supplied; no significance claim follows.
