# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: leverage-influence
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

x <- c(0,1,2,3,4,10)
y <- c(1,2,5,8,9,5)
fit <- lm(y ~ x)
# Compare the full fit with a documented sensitivity fit.
coef(fit)
coef(lm(y[-6] ~ x[-6]))
# Examine predictor leverage, raw residuals, and influence together.
data.frame(x=x,y=y,
  leverage=hatvalues(fit),
  raw_residual=residuals(fit),
  cooks_distance=cooks.distance(fit))
plot(x,y,pch=16,xlab="x",ylab="y")
abline(fit,col="firebrick",lwd=2)
abline(lm(y[-6] ~ x[-6]),col="steelblue",lty=2,lwd=2)
