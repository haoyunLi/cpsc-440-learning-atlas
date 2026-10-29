# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: unbalanced-anova-worked
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

y <- c(2,4, 5,5,8, 8,9,10,11)
group <- factor(rep(c("A","B","C"),c(2,3,4)))
fit <- aov(y ~ group)
summary(fit)
# Verify the decomposition using all observations.
sse <- sum(residuals(fit)^2)
sst <- sum((y-mean(y))^2)
c(grand_mean=mean(y),SS_between=sst-sse,SS_error=sse,SS_total=sst)
# Check model diagnostics; a small example cannot certify assumptions.
qqnorm(residuals(fit)); qqline(residuals(fit))
plot(fitted(fit),residuals(fit),xlab="Fitted values",ylab="Residuals")
abline(h=0,lty=2)
