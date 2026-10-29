# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: factorial-simple-effects
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# The same original 2-by-3 data, fully defined for this standalone example.
d <- data.frame(
  A=factor(rep(c("A1","A2"),each=12)),
  B=factor(rep(rep(c("B1","B2","B3"),each=4),times=2)),
  y=rep(c(10,10,10,10,14,18),each=4)+
    rep(c(-1.5,-.5,.5,1.5),times=6))
# Both factors are fixed; inference assumes independent normal errors
# with one common variance across the six complete cells.
fit <- lm(y ~ A*B,data=d)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
cell_mean <- with(d,tapply(y,list(A,B),mean))
cell_n <- with(d,table(A,B))
print(cell_n)
print(cell_mean)
print(anova(fit))
stopifnot(all(cell_n==4),error_df==18,abs(mse-5/3)<1e-12)
# Prespecified family: one joint equality test across B within each A.
# Use the full model MSE and df, not separate subset-model residuals.
r <- 4
slice_df <- ncol(cell_mean)-1
ss_slice <- apply(cell_mean,1,function(mu) r*sum((mu-mean(mu))^2))
F_slice <- ss_slice/slice_df/mse
p_raw <- pf(F_slice,slice_df,error_df,lower.tail=FALSE)
family_size <- nrow(cell_mean)
alpha <- .05
results <- data.frame(A=rownames(cell_mean),SS=unname(ss_slice),
                      df1=slice_df,MSE=mse,df2=error_df,
                      F=unname(F_slice),P_raw=unname(p_raw),
                      P_Bonferroni=p.adjust(unname(p_raw),method="bonferroni"))
critical <- qf(1-alpha/family_size,slice_df,error_df)
results$reject_family <- results$P_Bonferroni<=alpha
print(results,digits=12,row.names=FALSE)
print(c(per_test_alpha=alpha/family_size,F_critical=critical))
# Independent covariance check using two contrasts from each fitted slice.
# B2-B1 and B3-B1 share B1, so their covariance is not zero.
grid <- expand.grid(A=levels(d$A),B=levels(d$B))
Xg <- model.matrix(delete.response(terms(fit)),grid)
F_covariance <- sapply(levels(d$A),function(level) {
  X_slice <- Xg[grid$A==level,,drop=FALSE]
  L <- rbind(X_slice[2,]-X_slice[1,],X_slice[3,]-X_slice[1,])
  estimate <- as.vector(L%*%coef(fit))
  V <- L%*%vcov(fit)%*%t(L)
  expected_V <- (mse/r)*matrix(c(2,1,1,2),nrow=2)
  stopifnot(max(abs(V-expected_V))<1e-10)
  as.numeric(t(estimate)%*%solve(V,estimate)/nrow(L))
})
print(F_covariance)
# Separate subset fits happen to have the same MSE for these constructed data,
# but use only 9 residual df; they are not the full-model slice tests above.
subset_df <- sapply(levels(d$A),function(level)
  df.residual(lm(y ~ B,data=d[d$A==level,])))
print(subset_df)
stopifnot(max(abs(ss_slice-c(0,128)))<1e-10,
          max(abs(F_slice-c(0,38.4)))<1e-10,
          max(abs(F_covariance-F_slice))<1e-10,
          max(abs(p_raw-c(1,3.2075800960194e-7)))<1e-12,
          all(subset_df==9),
          identical(results$reject_family,c(FALSE,TRUE)))
# These two joint tests do not simultaneously protect the three pairwise
# A2-minus-A1 comparisons in the preceding, separately defined example.
