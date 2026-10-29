# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: orthogonal
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

d <- data.frame(group=factor(rep(c("A","B","C"),each=3)),
                y=c(4,5,6,7,8,9,10,11,12))
fit <- aov(y ~ group,data=d)
group_means <- as.numeric(tapply(d$y,d$group,mean))
ni <- as.numeric(table(d$group))
error_df <- df.residual(fit)
mse <- sum(residuals(fit)^2)/error_df
C <- rbind(A_vs_BC=c(-2,1,1),B_vs_C=c(0,1,-1))
# This matrix equals the covariance matrix divided by the common variance.
covariance_factor <- C %*% diag(1/ni) %*% t(C)
estimate <- as.vector(C %*% group_means)
ss_contrast <- estimate^2/diag(covariance_factor)
sstrt <- sum(ni*(group_means-weighted.mean(group_means,ni))^2)
print(covariance_factor)
print(data.frame(estimate=estimate,SS=ss_contrast,df=1,
                 F=ss_contrast/mse,
                 p=pf(ss_contrast/mse,1,error_df,lower.tail=FALSE)))
print(c(sum_contrast_SS=sum(ss_contrast),treatment_SS=sstrt))
stopifnot(abs(covariance_factor[1,2])<1e-12,
          abs(sum(ss_contrast)-sstrt)<1e-12)
# A nonorthogonal basis does not give an additive SS decomposition.
C_other <- rbind(A_minus_B=c(1,-1,0),B_minus_C=c(0,1,-1))
L_other <- as.vector(C_other %*% group_means)
ss_other <- L_other^2/rowSums(sweep(C_other^2,2,ni,"/"))
print(c(sum_nonorthogonal_SS=sum(ss_other),treatment_SS=sstrt))
