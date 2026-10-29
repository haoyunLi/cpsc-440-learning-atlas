n <- 12; distinct_x <- 4; sse_linear <- 30; ss_pure <- 6
ss_lack <- sse_linear-ss_pure
df_lack <- distinct_x-2; df_pure <- n-distinct_x
answer <- (ss_lack/df_lack)/(ss_pure/df_pure)
print(c(F_lack_of_fit=answer,
        p=pf(answer,df_lack,df_pure,lower.tail=FALSE)))
