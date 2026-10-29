# Supplied ANOVA moment estimates for a balanced, complete random-block model.
n_treatments <- 4
n_blocks <- 6
variance_block <- 20
variance_error <- 9
variance_mean <- (variance_block+variance_error)/n_blocks
covariance_means <- variance_block/n_blocks
variance_difference <- 2*variance_mean-2*covariance_means
answer <- sqrt(variance_difference)
print(c(variance_mean=variance_mean,covariance_means=covariance_means,
        variance_difference=variance_difference,answer=answer))
# Reproduce common alternatives for diagnosis, without using them as the answer.
print(c(single_mean_SE=sqrt(variance_mean),
        incorrectly_independent_means=sqrt(2*variance_mean),
        one_error_component=sqrt(variance_error/n_blocks),
        variance_instead_of_SE=variance_difference))
stopifnot(isTRUE(all.equal(answer,sqrt(2*variance_error/n_blocks))))
