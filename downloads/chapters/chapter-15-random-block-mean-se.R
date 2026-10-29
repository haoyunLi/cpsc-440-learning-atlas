# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: random-block-mean-se
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original complete RCBD: every treatment occurs in every sampled block.
d <- data.frame(
  treatment=factor(rep(c("A", "B", "C"), each=5)),
  block=factor(rep(1:5, times=3)),
  y=c(15, 19, 20, 23, 23, 20, 20, 24, 24, 27, 21, 23, 24, 27, 30))
with(d, table(treatment, block))
# Balanced ANOVA supplies mean squares for the moment estimates below.
# This aov call is not a REML mixed-model fit.
fit <- aov(y ~ treatment + block, data=d)
tab <- summary(fit)[[1]]
tab
n_treatments <- nlevels(d$treatment)
n_blocks <- nlevels(d$block)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
ms_block <- tab["block", "Mean Sq"]
variance_block <- (ms_block-mse)/n_treatments
variance_mean <- (variance_block+mse)/n_blocks
covariance_means <- variance_block/n_blocks
se_mean <- sqrt(variance_mean)
se_difference <- sqrt(2*variance_mean-2*covariance_means)
c(variance_error=mse, variance_block=variance_block,
  SE_population_mean=se_mean, covariance_means=covariance_means,
  SE_same_block_difference=se_difference,
  wrong_independent_mean_SE=sqrt(2*variance_mean))
# One prespecified treatment contrast, using the exact balanced-model error df.
treatment_mean <- tapply(d$y, d$treatment, mean)
estimate <- unname(treatment_mean["B"]-treatment_mean["A"])
t_value <- estimate/se_difference
critical <- qt(.975, df=error_df)
c(B_minus_A=estimate, SE=se_difference, df=error_df, t=t_value,
  p_two_sided=2*pt(-abs(t_value), df=error_df),
  lower=estimate-critical*se_difference,
  upper=estimate+critical*se_difference)
