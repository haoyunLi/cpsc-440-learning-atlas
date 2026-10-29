# Original constructed data: only the sixth point lies exactly on the five-point fit.
d <- data.frame(x=c(1,2,3,4,5,9),y=c(2,3,7,7,11,19.2))
fit_five <- lm(y ~ x,data=d[1:5,])
fit_six <- lm(y ~ x,data=d)
original_sixth_prediction <- predict(fit_five,newdata=d[6,,drop=FALSE])
h6 <- hatvalues(fit_six)[6]
e6 <- residuals(fit_six)[6]
D6 <- cooks.distance(fit_six)[6]
summary_row <- function(fit,x) {
  mse <- deviance(fit)/df.residual(fit)
  Sxx <- sum((x-mean(x))^2)
  c(SSE=deviance(fit),error_df=df.residual(fit),MSE=mse,Sxx=Sxx,
    slope_SE=sqrt(mse/Sxx))
}
comparison <- rbind(five=summary_row(fit_five,d$x[1:5]),
                    six=summary_row(fit_six,d$x))
print(rbind(five=coef(fit_five),six=coef(fit_six)),digits=12)
print(comparison,digits=12)
print(c(original_prediction_at_9=original_sixth_prediction,
        h6=h6,e6=e6,Cook6=D6),digits=12)
# The first five observations retain nonzero residual variation.
stopifnot(abs(deviance(fit_five)-3.6)<1e-12,
          abs(deviance(fit_six)-3.6)<1e-12,
          max(abs(coef(fit_five)-c(-.6,2.2)))<1e-12,
          max(abs(coef(fit_six)-coef(fit_five)))<1e-12,
          abs(original_sixth_prediction-19.2)<1e-12,
          abs(h6-19/24)<1e-12,abs(e6)<1e-12,abs(D6)<1e-20,
          abs(comparison['five','slope_SE']-sqrt(.12))<1e-12,
          abs(comparison['six','slope_SE']-.15)<1e-12,
          abs(summary(fit_six)$coefficients['x','Std. Error']-.15)<1e-12)
# These SEs describe this constructed dataset under the stated regression model.
# They do not imply that every added observation reduces the estimated SE.

