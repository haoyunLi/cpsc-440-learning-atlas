# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: unequal-n-pairwise
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original one-way experiment with unequal independent group sizes.
y <- c(8,10,12, 10,10,12,14,14,
       12.2,13.2,13.2,14.2,14.2,15.2,15.2,16.2)
group <- factor(rep(c("A","B","C"),c(3,5,8)))
d <- data.frame(group=group,y=y)
fit <- aov(y ~ group,data=d)
print(summary(fit))
ni <- as.numeric(table(group))
means <- as.numeric(tapply(y,group,mean))
names(ni) <- names(means) <- levels(group)
g <- length(ni)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
# Define all three unordered pairs as the Tukey-Kramer family before analysis.
pairs <- combn(seq_len(g),2)
labels <- apply(pairs,2,function(p) paste0(names(means)[p[2]],"-",names(means)[p[1]]))
estimate <- apply(pairs,2,function(p) means[p[2]]-means[p[1]])
se <- apply(pairs,2,function(p) sqrt(mse*sum(1/ni[p])))
t_obs <- estimate/se
ordinary_p <- 2*pt(-abs(t_obs),df=error_df)
t_critical <- qt(.975,df=error_df)
ordinary_half <- t_critical*se
q_critical <- qtukey(.95,nmeans=g,df=error_df)
q_scale <- se/sqrt(2)
tk_half <- q_critical*q_scale
q_obs <- abs(estimate)/q_scale
tk_p <- ptukey(q_obs,nmeans=g,df=error_df,lower.tail=FALSE)
result <- data.frame(comparison=labels,estimate=estimate,SE=se,
  ordinary_lower=estimate-ordinary_half,ordinary_upper=estimate+ordinary_half,
  ordinary_p=ordinary_p,
  TK_lower=estimate-tk_half,TK_upper=estimate+tk_half,TK_adjusted_p=tk_p)
print(c(N=length(y),groups=g,error_df=error_df,SSE=deviance(fit),MSE=mse,
        t_critical=t_critical,q_critical=q_critical))
print(result,row.names=FALSE)
# Verify every manual interval and adjusted probability against base R.
tk <- TukeyHSD(fit,which="group",conf.level=.95)$group
print(tk)
stopifnot(error_df==13,abs(mse-36/13)<1e-12,
          max(abs(tk[labels,"diff"]-estimate))<1e-10,
          max(abs(tk[labels,"lwr"]-(estimate-tk_half)))<1e-10,
          max(abs(tk[labels,"upr"]-(estimate+tk_half)))<1e-10,
          max(abs(tk[labels,"p adj"]-tk_p))<1e-10)
