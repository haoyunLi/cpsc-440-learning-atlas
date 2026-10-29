a <- 2
b <- 3
blocks <- 4
ss_ab <- 30
ss_block <- 96
sse <- 45
N <- a*b*blocks
interaction_df <- (a-1)*(b-1)
error_df <- (a*b-1)*(blocks-1)
ms_ab <- ss_ab/interaction_df
mse <- sse/error_df
answer <- ms_ab/mse
print(c(N=N,interaction_df=interaction_df,error_df=error_df,
        MS_interaction=ms_ab,MSE=mse,F=answer,
        p=pf(answer,interaction_df,error_df,lower.tail=FALSE)))
# The block mean square is not this fixed interaction test's denominator.
print(c(MS_block=ss_block/(blocks-1)))
stopifnot(N==24,error_df==15,answer==5)
