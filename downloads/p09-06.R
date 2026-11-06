y <- c(9,12,12,15,13,16,16,19,17,20,20,23)
g <- factor(rep(LETTERS[1:3],each=4))
fit <- aov(y~g)
tab <- TukeyHSD(fit)$g
print(tab)
stopifnot(identical(unname(tab[,"lwr"]>0),c(FALSE,TRUE,FALSE)))
