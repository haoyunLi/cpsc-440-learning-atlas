# Original seven-pot data; the positive direction was prespecified.
d <- data.frame(dose=1:7, biomass=c(16,14,17,12,14,13,10))
fit <- lm(biomass ~ dose, data=d)
out <- summary(fit)
error_df <- df.residual(fit)
t_value <- unname(out$coefficients["dose", "t value"])
answer <- pt(t_value, df=error_df, lower.tail=FALSE)
p_two <- unname(out$coefficients["dose", "Pr(>|t|)"])
p_left <- pt(t_value, df=error_df)
print(out$coefficients)
print(c(error_df=error_df, t=t_value, answer=answer,
        P_two_sided=p_two, P_left=p_left))
# Cross-check the two-sided F relation and the sign-dependent tail conversion.
f_value <- unname(out$fstatistic["value"])
stopifnot(abs(f_value-t_value^2)<1e-10,
          abs(pf(f_value,1,error_df,lower.tail=FALSE)-p_two)<1e-10,
          abs(answer-(1-p_two/2))<1e-10,
          abs(answer-0.974344164260919)<1e-10)

