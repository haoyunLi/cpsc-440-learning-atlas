ni <- c(A=4,B=6,C=8)
mu <- c(A=20,B=23,C=25)
# Generate complete synthetic groups with the stated means and sample variance 9.
make_group <- function(n,center) {
  base <- seq_len(n)
  center+3*(base-mean(base))/sd(base)
}
y <- unlist(Map(make_group,ni,mu),use.names=FALSE)
group <- factor(rep(names(ni),ni),levels=names(ni))
fit <- aov(y ~ group)
mse <- deviance(fit)/df.residual(fit)
df <- df.residual(fit)
g <- nlevels(group)
se <- sqrt(mse*(1/ni["A"]+1/ni["C"]))
qcrit <- qtukey(.95,nmeans=g,df=df)
answer <- unname(qcrit*se/sqrt(2))
estimate <- mu["C"]-mu["A"]
print(c(MSE=mse,error_df=df,qcrit=qcrit,SE=se,answer=answer,
        lower=estimate-answer,upper=estimate+answer))
tk <- TukeyHSD(fit,which="group")$group
print(tk)
print(c(ordinary_LSD_half=qt(.975,df)*se,
        wrong_no_sqrt2=qcrit*se,wrong_average_n=qcrit*sqrt(mse/mean(ni))))
stopifnot(df==15,abs(mse-9)<1e-10,
          abs(answer-4.7718575113818)<1e-10,
          abs(tk["C-A","upr"]-tk["C-A","diff"]-answer)<1e-10)
