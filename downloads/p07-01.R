n <- 12; s <- 3
ci <- (n-1)*s^2/qchisq(c(0.975,0.025), df = n-1)
answer <- ci[1]
ci
