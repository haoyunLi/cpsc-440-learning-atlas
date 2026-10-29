# Supplied sums of squares for an original complete five-by-five Latin square.
t <- 5
ss_total <- 310
ss_row <- 64
ss_column <- 46
ss_treatment <- 128
ss_error <- ss_total-ss_row-ss_column-ss_treatment
df_treatment <- t-1
df_error <- (t-1)*(t-2)
ms_treatment <- ss_treatment/df_treatment
mse <- ss_error/df_error
answer <- ms_treatment/mse
print(c(SS_error=ss_error,df_error=df_error,MS_treatment=ms_treatment,
        MSE=mse,answer=answer,
        p_value=pf(answer,df_treatment,df_error,lower.tail=FALSE)))
# Alternative calculations identify distinct mistakes.
print(c(MSE_only=mse,
        CRD_ignoring_blocks=ms_treatment/((ss_total-ss_treatment)/(t*t-t)),
        missing_block_SS_subtraction=ms_treatment/((ss_total-ss_treatment)/df_error),
        numerator_SS_instead_of_MS=ss_treatment/mse,
        reversed_ratio=mse/ms_treatment))
