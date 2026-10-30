# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: prediction
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce the existing five-point road example from complete inline data.
d <- data.frame(x=c(1,3,4,5,7), y=c(6,14,10,14,26))
fit <- lm(y ~ x, data=d)
n <- nrow(d)
xbar <- mean(d$x)
Sxx <- sum((d$x-xbar)^2)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
critical <- qt(.975, df=error_df)
new <- data.frame(x=c(4,7,8))
# Keep the baseline and distance contributions visible.
baseline <- rep(1/n, nrow(new))
distance <- (new$x-xbar)^2/Sxx
h0 <- baseline+distance
mean_variance <- mse*h0
prediction_variance <- mean_variance+mse
mean_se <- sqrt(mean_variance)
prediction_se <- sqrt(prediction_variance)
yhat <- unname(coef(fit)[1]+coef(fit)[2]*new$x)
manual_ci <- cbind(fit=yhat, lwr=yhat-critical*mean_se,
                   upr=yhat+critical*mean_se)
manual_pi <- cbind(fit=yhat, lwr=yhat-critical*prediction_se,
                   upr=yhat+critical*prediction_se)
# Each row is an interval at one specified x, not a simultaneous band.
ci_r <- predict(fit, newdata=new, interval="confidence", level=.95)
pi_r <- predict(fit, newdata=new, interval="prediction", level=.95)
mean_se_r <- predict(fit, newdata=new, se.fit=TRUE)$se.fit
results <- data.frame(x0=new$x, fitted=yhat, baseline=baseline,
                      distance=distance, h0=h0, mean_SE=mean_se,
                      prediction_SE=prediction_se,
                      CI_lower=manual_ci[,"lwr"], CI_upper=manual_ci[,"upr"],
                      PI_lower=manual_pi[,"lwr"], PI_upper=manual_pi[,"upr"])
print(c(n=n, xbar=xbar, Sxx=Sxx, MSE=mse,
        error_df=error_df, t_critical=critical), digits=12)
print(results, digits=12)
print(ci_r, digits=12)
print(pi_r, digits=12)
stopifnot(error_df==3,
          max(abs(h0-c(.2,.65,1)))<1e-12,
          max(abs(manual_ci-ci_r))<1e-12,
          max(abs(manual_pi-pi_r))<1e-12,
          max(abs(mean_se-mean_se_r))<1e-12,
          max(abs(prediction_variance-mean_variance-mse))<1e-12)
# Compare a hypothetical future independent outcome without refitting the model.
row7 <- which(new$x==7)
future_y <- 35
inside_mean_ci <- future_y>=ci_r[row7,"lwr"] && future_y<=ci_r[row7,"upr"]
inside_prediction_interval <- future_y>=pi_r[row7,"lwr"] && future_y<=pi_r[row7,"upr"]
print(c(future_y=future_y, inside_mean_CI=inside_mean_ci,
        inside_individual_PI=inside_prediction_interval))
stopifnot(!inside_mean_ci, inside_prediction_interval)
# One outcome inside or outside an interval does not establish model validity.
# x=8 is outside the observed range; computable limits do not justify extrapolation.
