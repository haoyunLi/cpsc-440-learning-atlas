# Exact planning model: independent normal observations with known sigma.
sigma <- 6; delta <- 2; alpha <- 0.05; beta <- 0.10
answer <- ceiling((sigma*(qnorm(1-alpha)+qnorm(1-beta))/delta)^2)
power <- function(n) 1-pnorm(qnorm(1-alpha)-delta*sqrt(n)/sigma)
print(c(n = answer, achieved_power = power(answer),
        previous_n_power = power(answer-1)))
