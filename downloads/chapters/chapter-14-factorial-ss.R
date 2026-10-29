# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: factorial-ss
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original balanced complete 3-by-2 fixed-effects design, three pots per cell.
d <- expand.grid(replicate=1:3, B=factor(c("B1","B2")),
                 A=factor(c("A1","A2","A3")))
d$y <- rep(c(10,20,12,22,14,24),each=3)+rep(c(-1,0,1),6)
fit <- aov(y ~ A*B,data=d)
print(with(d,table(A,B)))
cell_mean <- with(d,tapply(y,list(A,B),mean))
print(cell_mean)
print(summary(fit))
a <- nlevels(d$A)
b <- nlevels(d$B)
r <- 3
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
marginal_A <- rowMeans(cell_mean)
marginal_B <- colMeans(cell_mean)
print(c(A_observations_per_mean=b*r,B_observations_per_mean=a*r,
        MSE=mse,error_df=error_df))
print(marginal_A)
print(marginal_B)
# The prespecified family contains all three pairs of A marginal means only.
pairs <- combn(seq_len(a),2)
labels <- apply(pairs,2,function(z) paste0(rownames(cell_mean)[z[2]],"-",
                                         rownames(cell_mean)[z[1]]))
estimate <- apply(pairs,2,function(z) marginal_A[z[2]]-marginal_A[z[1]])
q_scale <- sqrt(mse/(b*r))
critical <- qtukey(.95,nmeans=a,df=error_df)
half <- critical*q_scale
p_adj <- ptukey(abs(estimate)/q_scale,nmeans=a,df=error_df,lower.tail=FALSE)
manual <- data.frame(pair=labels,diff=estimate,lwr=estimate-half,
                     upr=estimate+half,p_adj=p_adj)
print(c(q_critical=critical,half_width=half))
print(manual,row.names=FALSE)
tk <- TukeyHSD(fit,which="A",conf.level=.95)$A
print(tk)
stopifnot(error_df==12,abs(mse-1)<1e-10,
          max(abs(tk[labels,"diff"]-estimate))<1e-10,
          max(abs(tk[labels,"lwr"]-(estimate-half)))<1e-10,
          max(abs(tk[labels,"upr"]-(estimate+half)))<1e-10,
          max(abs(tk[labels,"p adj"]-p_adj))<1e-10)
# Omitting B changes the model and pools its systematic variation into residuals.
A_only <- aov(y ~ A,data=d)
wrong_mse <- deviance(A_only)/df.residual(A_only)
wrong_half <- qtukey(.95,nmeans=a,df=df.residual(A_only))*
              sqrt(wrong_mse/(b*r))
print(c(omitted_B_SSE=deviance(A_only),omitted_B_df=df.residual(A_only),
        omitted_B_MSE=wrong_mse,omitted_B_half_width=wrong_half))
print(TukeyHSD(A_only,which="A"))
stopifnot(abs(wrong_mse-30.8)<1e-10)
