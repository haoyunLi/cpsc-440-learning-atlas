# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: regression-anova
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original data: one independent pot at each planned supplement dose.
d <- data.frame(dose=1:8, biomass=c(18,19,16,17,14,15,16,11))
fit <- lm(biomass ~ dose, data=d)
out <- summary(fit)
print(out$coefficients)
print(anova(fit))
# The alternative beta_1 > 0 was specified before observing the data.
error_df <- df.residual(fit)
t_value <- unname(out$coefficients["dose", "t value"])
p_greater <- pt(t_value, df=error_df, lower.tail=FALSE)
p_less <- pt(t_value, df=error_df)
p_two <- 2*pt(abs(t_value), df=error_df, lower.tail=FALSE)
f_value <- unname(out$fstatistic["value"])
p_f <- pf(f_value, df1=1, df2=error_df, lower.tail=FALSE)
print(c(error_df=error_df, t=t_value, P_greater=p_greater,
        P_less=p_less, P_two_sided=p_two, F=f_value, P_F=p_f))
# Verify the coefficient test from centered sums and the residual MSE.
x <- d$dose
y <- d$biomass
Sxx <- sum((x-mean(x))^2)
Sxy <- sum((x-mean(x))*(y-mean(y)))
slope <- Sxy/Sxx
intercept <- mean(y)-slope*mean(x)
sse <- sum((y-intercept-slope*x)^2)
mse <- sse/(length(y)-2)
t_manual <- slope/sqrt(mse/Sxx)
stopifnot(abs(t_value-t_manual)<1e-10,
          abs(f_value-t_value^2)<1e-10,
          abs(p_f-p_two)<1e-10,
          abs(p_two-out$coefficients["dose", "Pr(>|t|)"])<1e-10,
          abs(p_greater-(1-p_two/2))<1e-10)
