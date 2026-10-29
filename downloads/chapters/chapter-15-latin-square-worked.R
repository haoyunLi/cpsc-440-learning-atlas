# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: latin-square-worked
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Each row of this original layout contains all four treatments once.
layout <- matrix(c("A", "B", "C", "D",
                   "B", "C", "D", "A",
                   "C", "D", "A", "B",
                   "D", "A", "B", "C"), nrow=4, byrow=TRUE)
d <- data.frame(
  row=factor(rep(1:4, each=4)), column=factor(rep(1:4, times=4)),
  treatment=factor(c(t(layout))),
  y=c(6.5, 7.5, 10.5, 14.5, 8.5, 12.5, 15.5, 10.5,
      12.5, 16.5, 10.5, 15.5, 17.5, 12.5, 16.5, 16.5))
with(d, table(row, treatment))
with(d, table(column, treatment))
grand <- mean(d$y)
row_mean <- tapply(d$y, d$row, mean)
column_mean <- tapply(d$y, d$column, mean)
treatment_mean <- tapply(d$y, d$treatment, mean)
list(grand=grand, row=row_mean, column=column_mean,
     treatment=treatment_mean)
# Three marginal means include the grand mean three times.
fitted_manual <- row_mean[as.character(d$row)] +
  column_mean[as.character(d$column)] +
  treatment_mean[as.character(d$treatment)] - 2*grand
residual_manual <- d$y-fitted_manual
c(SS_row=4*sum((row_mean-grand)^2),
  SS_column=4*sum((column_mean-grand)^2),
  SS_treatment=4*sum((treatment_mean-grand)^2),
  SS_error=sum(residual_manual^2), SS_total=sum((d$y-grand)^2))
data.frame(d, fitted=as.numeric(fitted_manual),
           residual=as.numeric(residual_manual))
fit <- aov(y ~ row + column + treatment, data=d)
summary(fit)
# The family contains all six pairs among the four treatments.
TukeyHSD(fit, which="treatment", conf.level=.95)
mse <- deviance(fit)/df.residual(fit)
qtukey(.95, nmeans=4, df=df.residual(fit))*sqrt(mse/4)
