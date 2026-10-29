# Synthetic teaching data: independent units in three groups
d <- data.frame(
  group = factor(rep(c("A", "B", "C"), each = 5)),
  y = c(8, 10, 9, 12, 11, 12, 14, 13, 16, 15, 15, 17, 16, 19, 18)
)
str(d)
head(d)
table(d$group)
stopifnot(!anyNA(d), is.numeric(d$y))
aggregate(y ~ group, d, mean)
aggregate(y ~ group, d, sd)
boxplot(y ~ group, data = d, ylab = "Response")

# Fit the model before examining its residuals
fit <- aov(y ~ group, data = d)
summary(fit)
e <- residuals(fit)
par(mfrow = c(1, 2))
plot(fitted(fit), e, xlab = "Fitted", ylab = "Residual")
abline(h = 0, lty = 2)
qqnorm(e)
qqline(e)
par(mfrow = c(1, 1))

# Median-centered Brown-Forsythe test
d$z <- abs(d$y - ave(d$y, d$group, FUN = median))
summary(aov(z ~ group, data = d))

# All pairwise mean comparisons with family-wise adjustment
TukeyHSD(fit)
sessionInfo()
