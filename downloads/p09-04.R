estimate <- -3
se <- 1.25
error_df <- 16
t_observed <- estimate/se
F_observed <- t_observed^2
p_two <- 2*pt(-abs(t_observed), df=error_df)
p_F <- pf(F_observed, df1=1, df2=error_df, lower.tail=FALSE)
# The alternative was fixed as L > 0 before observing the estimate.
p_right <- pt(t_observed, df=error_df, lower.tail=FALSE)
p_left <- pt(t_observed, df=error_df)
print(c(t=t_observed, F=F_observed, p_two_sided=p_two,
        p_F=p_F, p_prespecified_right=p_right, p_left=p_left))
stopifnot(isTRUE(all.equal(p_two,p_F)), p_right>.05)
