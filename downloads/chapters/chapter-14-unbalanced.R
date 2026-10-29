# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: unbalanced
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original complete-cell data matching the counts and means above.
d <- data.frame(
  A=factor(c(rep("V1", 10), rep("V2", 4))),
  B=factor(c(rep("Low", 9), "High", rep(c("Low", "High"), each=2)),
           levels=c("Low", "High")),
  y=c(8, 9, 9, 10, 10, 10, 11, 11, 12, 20, 11, 13, 17, 19))
with(d, table(A, B))
aggregate(y ~ A + B, data=d, FUN=mean)
# Observed raw means weight cells by their sample counts.
aggregate(y ~ A, data=d, FUN=mean)
fit <- lm(y ~ A*B, data=d)
# One row per cell supplies equal weights over B within each A.
grid <- expand.grid(A=levels(d$A), B=levels(d$B))
grid$estimate <- predict(fit, newdata=grid)
grid
aggregate(estimate ~ A, data=grid, FUN=mean)
# Optional equivalent calls if the emmeans package is installed:
# emmeans::emmeans(fit, ~ A, weights="equal")
# emmeans::emmeans(fit, ~ A | B)
