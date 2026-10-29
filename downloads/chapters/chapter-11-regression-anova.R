# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: regression-anova
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce the course road example from complete inline data.
d <- data.frame(x=c(1,3,4,5,7), y=c(6,14,10,14,26))
fit <- lm(y ~ x, data=d)
b <- coef(fit)
V <- vcov(fit)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
critical <- qt(.975, df=error_df)
se <- sqrt(diag(V))
data.frame(estimate=b, SE=se,
           lower=b-critical*se, upper=b+critical*se)
confint(fit)
V
# Prediction is a linear combination of the same correlated coefficients.
x0 <- 4
a <- c(1, x0)
variance_mean <- as.numeric(t(a) %*% V %*% a)
estimate_mean <- as.numeric(a %*% b)
c(fitted_mean=estimate_mean, variance_mean=variance_mean,
  SE_mean=sqrt(variance_mean),
  wrong_variance_without_covariance=V[1,1]+x0^2*V[2,2],
  SE_new_observation=sqrt(mse+variance_mean))
predict(fit, newdata=data.frame(x=x0), se.fit=TRUE, interval="confidence")
predict(fit, newdata=data.frame(x=x0), interval="prediction")
# Centering changes the intercept's meaning, not the fitted line.
d$xc <- d$x-mean(d$x)
centered_fit <- lm(y ~ xc, data=d)
summary(centered_fit)$coefficients
vcov(centered_fit)
