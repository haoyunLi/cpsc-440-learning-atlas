# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: diagnostics
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce the nine observations in the preceding ANOVA example.
d <- data.frame(group=factor(rep(c("A", "B", "C"), each=3)),
                y=c(4, 5, 6, 7, 8, 9, 10, 11, 12))
fit <- aov(y ~ group, data=d)
summary(fit)
data.frame(d, fitted=fitted(fit), residual=residuals(fit))
par(mfrow=c(1, 2))
plot(fitted(fit), residuals(fit), xlab="Fitted group mean",
     ylab="Residual", main="Residuals vs fitted")
abline(h=0, lty=2)
qqnorm(residuals(fit))
qqline(residuals(fit))
par(mfrow=c(1, 1))
