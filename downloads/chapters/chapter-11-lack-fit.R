# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: lack-fit
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original data: four x levels, three independent units per level.
d <- data.frame(x=rep(1:4, each=3),
                y=c(2, 3, 4, 5, 6, 7, 10, 11, 12, 18, 19, 20))
with(d, table(x))
aggregate(y ~ x, data=d, FUN=mean)
line <- lm(y ~ x, data=d)
cell <- lm(y ~ factor(x), data=d)
# The cell model leaves pure error from genuine within-x replication.
ss_pe <- deviance(cell)
df_pe <- df.residual(cell)
ss_lof <- deviance(line) - ss_pe
df_lof <- df.residual(line) - df_pe
F_lof <- (ss_lof/df_lof)/(ss_pe/df_pe)
c(SSE_line=deviance(line), SS_pure_error=ss_pe, SS_lack_of_fit=ss_lof,
  df_pure_error=df_pe, df_lack_of_fit=df_lof, F=F_lof,
  p_value=pf(F_lof, df_lof, df_pe, lower.tail=FALSE))
anova(line, cell)
# A prespecified quadratic offers a second mean-form illustration.
quadratic <- lm(y ~ x + I(x^2), data=d)
coef(quadratic)
anova(quadratic, cell)
par(mfrow=c(1, 2))
plot(d$x, residuals(quadratic), xlab="x", ylab="Quadratic residual",
     main="Residuals vs x")
abline(h=0, lty=2)
qqnorm(residuals(quadratic))
qqline(residuals(quadratic))
par(mfrow=c(1, 1))
# Both intervals below are conditional on the quadratic model assumptions.
predict(quadratic, data.frame(x=2.5), interval="confidence")
predict(quadratic, data.frame(x=2.5), interval="prediction")
