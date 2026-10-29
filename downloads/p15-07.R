# Summary values from an original complete RCBD planning scenario.
t <- 4
b <- 5
ms_block <- 14
mse_rcbd <- 2
mse_plan <- ((b-1)*ms_block+b*(t-1)*mse_rcbd)/(b*t-1)
re_plan <- mse_plan/mse_rcbd
continuous_reps <- b*re_plan
answer <- ceiling(continuous_reps)
reps <- c(answer-1,answer)
se_current <- sqrt(2*mse_rcbd/b)
se_planned <- sqrt(2*mse_plan/reps)
print(c(MSE_plan=mse_plan,RE_plan=re_plan,continuous_reps=continuous_reps,
        answer=answer,total_units=t*answer))
print(data.frame(reps=reps,planned_SE=se_planned,current_SE=se_current))
# Re-fitting the same data without blocks gives a different MSE ratio.
ss_block <- (b-1)*ms_block
ss_error <- (t-1)*(b-1)*mse_rcbd
refit_df <- t*(b-1)
refit_ratio <- ((ss_block+ss_error)/refit_df)/mse_rcbd
print(c(refit_df=refit_df,refit_ratio=refit_ratio,
        wrong_refit_based_reps=ceiling(b*refit_ratio),
        wrong_ratio_only=ceiling(re_plan),wrong_round_down=floor(continuous_reps)))
stopifnot(answer==12,se_planned[1]>se_current,se_planned[2]<=se_current)
