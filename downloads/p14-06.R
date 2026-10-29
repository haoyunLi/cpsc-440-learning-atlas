# Original balanced complete 3-by-2 design, two independent pots per cell.
d <- expand.grid(replicate=1:2,B=factor(c("B1","B2")),
                 A=factor(c("A1","A2","A3")))
d$y <- rep(c(8,12,10,14,13,17),each=2)+rep(c(-1,1),6)
fit <- aov(y ~ A*B,data=d)
print(with(d,tapply(y,list(A,B),mean)))
print(summary(fit))
a <- nlevels(d$A)
b <- nlevels(d$B)
r <- 2
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
critical <- qtukey(.95,nmeans=a,df=error_df)
answer <- critical*sqrt(mse/(b*r))
tk <- TukeyHSD(fit,which="A",conf.level=.95)$A
print(c(MSE=mse,error_df=error_df,marginal_n=b*r,
        q_critical=critical,answer=answer))
print(tk)
stopifnot(error_df==6,abs(mse-2)<1e-10,
          max(abs((tk[,"upr"]-tk[,"lwr"])/2-answer))<1e-10,
          abs(answer-3.06827443073426)<1e-10)
# Diagnostic values for common incorrect substitutions.
A_only <- aov(y ~ A,data=d)
wrong_mse <- deviance(A_only)/df.residual(A_only)
print(c(using_cell_n=critical*sqrt(mse/r),
        using_pairwise_SE=critical*sqrt(2*mse/(b*r)),
        using_total_N=critical*sqrt(mse/nrow(d)),
        omitting_B=qtukey(.95,a,df.residual(A_only))*sqrt(wrong_mse/(b*r))))

