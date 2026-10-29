n <- 10; ybar <- 54; s <- sqrt(40); mu0 <- 50
se <- s / sqrt(n)
t_stat <- (ybar - mu0) / se
answer <- pt(t_stat, df = n - 1, lower.tail = FALSE)
print(c(t = t_stat, df = n - 1, p_value = answer,
        lower_one_sided_95 = ybar - qt(0.95, n - 1) * se))
