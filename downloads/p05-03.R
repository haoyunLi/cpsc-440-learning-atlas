sigma <- 4; width <- 2; alpha <- 0.05
answer <- ceiling((qnorm(1-alpha/2) * sigma / (width/2))^2)
print(c(n = answer, width_at_n = 2*qnorm(0.975)*sigma/sqrt(answer),
        width_at_previous_n = 2*qnorm(0.975)*sigma/sqrt(answer-1)))
