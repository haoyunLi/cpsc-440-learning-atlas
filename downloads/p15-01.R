treatments <- 4; blocks <- 5
answer <- (treatments-1)*(blocks-1)
c(Treatment=treatments-1,Block=blocks-1,Error=answer,
  Total=treatments*blocks-1)
