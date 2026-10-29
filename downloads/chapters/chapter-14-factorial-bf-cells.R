# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: factorial-bf-cells
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original complete 2-by-3 design, with four independent units per cell.
d <- data.frame(
  A=factor(rep(c("A1", "A2"), each=12)),
  B=factor(rep(rep(c("B1", "B2", "B3"), each=4), times=2)),
  y=rep(c(10, 14, 18, 12, 16, 20), each=4) +
    rep(c(1, 1, 1, 1, 2, 4), each=4)*
    rep(c(-1.5, -.5, .5, 1.5), times=6))
d$cell <- interaction(d$A, d$B, drop=TRUE)
d$cell_median <- ave(d$y, d$cell, FUN=median)
d$z <- abs(d$y-d$cell_median)
d
aggregate(cbind(y, z) ~ cell, data=d, FUN=mean)
# Hand calculation uses the transformed response z.
cell_n <- table(d$cell)
z_mean <- tapply(d$z, d$cell, mean)
ss_between <- sum(as.numeric(cell_n)*(z_mean-mean(d$z))^2)
ss_error <- sum((d$z-ave(d$z, d$cell, FUN=mean))^2)
df_between <- nlevels(d$cell)-1
df_error <- nrow(d)-nlevels(d$cell)
F_bf <- (ss_between/df_between)/(ss_error/df_error)
c(SS_between=ss_between, SS_error=ss_error,
  df_between=df_between, df_error=df_error, F=F_bf,
  p_value=pf(F_bf, df_between, df_error, lower.tail=FALSE))
summary(aov(z ~ cell, data=d))
# In this complete-cell CRD, fitted residuals subtract a constant per cell.
full_model <- lm(y ~ A*B, data=d)
e <- residuals(full_model)
z_from_residuals <- abs(e-ave(e, d$cell, FUN=median))
isTRUE(all.equal(as.numeric(d$z), as.numeric(z_from_residuals)))
