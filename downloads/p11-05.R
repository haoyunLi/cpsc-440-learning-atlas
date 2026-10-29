# Original complete data for a five-point simple linear regression.
d <- data.frame(x=c(2,4,6,8,10),y=c(5,7,12,13,18))
fit <- lm(y~x,data=d)
V <- vcov(fit)
x0 <- 6
a <- c(1,x0)
variance_mean <- as.numeric(t(a)%*%V%*%a)
answer <- sqrt(variance_mean)
mse <- deviance(fit)/df.residual(fit)
print(coef(fit))
print(V)
print(c(variance_mean=variance_mean,answer=answer,
        predict_lm_SE=predict(fit,data.frame(x=x0),se.fit=TRUE)$se.fit,
        without_covariance=sqrt(V[1,1]+x0^2*V[2,2]),
        wrong_covariance_sign=sqrt(V[1,1]+x0^2*V[2,2]-2*x0*V[1,2]),
        new_observation_SE=sqrt(mse+variance_mean)))
stopifnot(abs(answer-predict(fit,data.frame(x=x0),se.fit=TRUE)$se.fit)<1e-10)
