n <- 12; s <- 3
variance_ci <- (n-1)*s^2/qchisq(c(0.975,0.025),n-1)
sd_ci <- sqrt(variance_ci)
answer <- sd_ci[2]
sd_ci
