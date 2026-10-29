n <- 16
sample_sd <- 2
null_sd <- 3
alpha <- .05
df <- n-1
Q <- df*sample_sd^2/null_sd^2
p_left <- pchisq(Q,df=df)
p_right <- pchisq(Q,df=df,lower.tail=FALSE)
p_two <- min(1,2*min(p_left,p_right))
# Keep the pre-specified alternatives separate.
print(data.frame(plan=c("A: left","B: equal-tail two-sided"),
                 p=c(p_left,p_two),reject=c(p_left,p_two)<alpha))
upper_one <- df*sample_sd^2/qchisq(alpha,df=df)
ci_two <- df*sample_sd^2/qchisq(c(1-alpha/2,alpha/2),df=df)
print(c(Q=Q,df=df,upper_95_one_sided=upper_one))
print(ci_two)
stopifnot(p_left<alpha,p_two>alpha,upper_one<null_sd^2,
          ci_two[1]<null_sd^2,ci_two[2]>null_sd^2)
