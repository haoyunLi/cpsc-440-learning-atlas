# Original complete-cell data, with unequal replication.
cells <- list(c(4,6),c(8,9,11,12),c(7,8,9),c(14,16))
ni <- lengths(cells)
d <- data.frame(A=factor(rep(c("A1","A1","A2","A2"),ni)),
                B=factor(rep(c("B1","B2","B1","B2"),ni)),y=unlist(cells))
fit_B <- lm(y ~ B,data=d)
fit_add <- lm(y ~ A+B,data=d)
fit_full <- lm(y ~ A*B,data=d)
ss_A_II <- deviance(fit_B)-deviance(fit_add)
num_df <- df.residual(fit_B)-df.residual(fit_add)
error_df <- df.residual(fit_full)
mse_full <- deviance(fit_full)/error_df
answer <- (ss_A_II/num_df)/mse_full
print(c(SSE_B=deviance(fit_B),SSE_add=deviance(fit_add),
        SSE_full=deviance(fit_full),SS_A_II=ss_A_II,
        numerator_df=num_df,error_df=error_df,MSE_full=mse_full,
        answer=answer,p=pf(answer,num_df,error_df,lower.tail=FALSE)))
# These alternatives are diagnostic values, not the requested full-model F.
wrong_additive <- (ss_A_II/num_df)/(deviance(fit_add)/df.residual(fit_add))
fit_0 <- lm(y ~ 1,data=d)
fit_A <- lm(y ~ A,data=d)
wrong_type_I <- (deviance(fit_0)-deviance(fit_A))/mse_full
print(c(additive_denominator_F=wrong_additive,
        A_first_TypeI_F=wrong_type_I,SS_instead_of_F=ss_A_II))
stopifnot(error_df==7,num_df==1,abs(answer-18.2030701754386)<1e-10)
