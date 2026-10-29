difference <- c(2, 3, 1, 4, 5)
fit <- t.test(difference, mu = 0)
answer <- unname(fit$statistic)
fit
