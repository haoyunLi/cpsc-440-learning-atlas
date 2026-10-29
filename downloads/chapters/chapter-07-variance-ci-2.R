# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: variance-ci
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Summary statistics from the constructed example; assume normal, independent data.
n <- 10
sample_variance <- 4
null_variance <- 12
alpha <- .05
df <- n-1
Q <- df*sample_variance/null_variance
p_left <- pchisq(Q,df=df)
p_right <- pchisq(Q,df=df,lower.tail=FALSE)
# The course uses an equal-tail two-sided test, not probability-density ordering.
p_two <- min(1,2*min(p_left,p_right))
critical_left <- qchisq(alpha,df=df)
critical_two <- qchisq(c(alpha/2,1-alpha/2),df=df)
# Match each test with its own confidence set.
upper_one_sided <- df*sample_variance/qchisq(alpha,df=df)
ci_two_sided <- df*sample_variance/qchisq(c(1-alpha/2,alpha/2),df=df)
print(c(Q=Q,df=df,p_left=p_left,p_equal_tail_two_sided=p_two,
        critical_left=critical_left,
        critical_two_low=critical_two[1],critical_two_high=critical_two[2]))
print(c(upper_95_one_sided=upper_one_sided,
        lower_95_two_sided=ci_two_sided[1],
        upper_95_two_sided=ci_two_sided[2]))
print(data.frame(test=c("left","equal-tail two-sided"),
                 p=c(p_left,p_two),reject=c(p_left,p_two)<alpha))
stopifnot(p_left<alpha,p_two>alpha,
          (p_left<alpha)==(upper_one_sided<null_variance),
          (p_two<alpha)==(null_variance<ci_two_sided[1] ||
                         null_variance>ci_two_sided[2]))
