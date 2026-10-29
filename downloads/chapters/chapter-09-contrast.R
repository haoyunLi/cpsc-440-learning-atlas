# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 09, section: contrast
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

group_means <- c(control=10,A=12,B=14,C=16)
ni <- rep(4,4)
mse <- 4
weights <- c(1,-1/3,-1/3,-1/3)
error_df <- sum(ni)-length(ni)
estimate <- sum(weights*group_means)
se <- sqrt(mse*sum(weights^2/ni))
t_obs <- estimate/se
f_obs <- t_obs^2
# The F tail equals the two-sided t probability, not either one-sided tail.
p_two <- 2*pt(-abs(t_obs),df=error_df)
p_f <- pf(f_obs,1,error_df,lower.tail=FALSE)
p_left <- pt(t_obs,error_df)
p_right <- pt(t_obs,error_df,lower.tail=FALSE)
ci <- estimate+c(-1,1)*qt(.975,error_df)*se
print(c(estimate=estimate,SE=se,df=error_df,t=t_obs,F=f_obs,
        p_two=p_two,p_F=p_f,p_left=p_left,p_right=p_right))
print(c(lower=ci[1],upper=ci[2]))
stopifnot(error_df==12,abs(p_two-p_f)<1e-12,
          abs(p_two-.00468160475316)<1e-12)
