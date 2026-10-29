# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: transform
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original positive data, fully specified on the log scale.
y <- exp(c(1.6, 1.8, 2.0, 2.2, 2.4, 2.6))
z <- log(y)
mu_ci <- t.test(z, conf.level=.95)$conf.int
geometric_estimate <- exp(mean(z))
geometric_ci <- exp(mu_ci)
# This is a plug-in arithmetic-mean estimate, not an arithmetic-mean CI.
arithmetic_plugin <- exp(mean(z)+var(z)/2)
data.frame(y=y, log_y=z)
c(mean_log=mean(z), variance_log=var(z),
  geometric_mean=geometric_estimate,
  observed_arithmetic_mean=mean(y), arithmetic_plugin=arithmetic_plugin)
mu_ci
geometric_ci
