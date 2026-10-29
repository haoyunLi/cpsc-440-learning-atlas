n1 <- 12; n2 <- 8; m1 <- 18; m2 <- 14; s1 <- 4; s2 <- 6
v1 <- s1^2/n1; v2 <- s2^2/n2
answer <- (m1-m2)/sqrt(v1+v2)
df <- (v1+v2)^2/(v1^2/(n1-1)+v2^2/(n2-1))
print(c(t = answer, df = df, two_sided_p = 2*pt(-abs(answer),df)))
