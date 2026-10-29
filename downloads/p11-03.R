x <- 1:5; y <- c(2,4,5,4,5)
fit <- lm(y ~ x)
answer <- summary(fit)$r.squared
print(c(R_squared=answer,correlation=cor(x,y),squared_r=cor(x,y)^2))
