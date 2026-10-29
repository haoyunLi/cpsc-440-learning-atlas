ratio <- 16/4; df1 <- 10-1; df2 <- 12-1
ci <- ratio/qf(c(0.975,0.025),df1,df2)
answer <- ci[2]
print(c(lower = ci[1], upper = ci[2]))
